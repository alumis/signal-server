import * as signalR from "@aspnet/signalr";
import * as signalRMsgPack from "@aspnet/signalr-protocol-msgpack";

import { SignalServer, ConnectionState } from "./SignalServer";
import { o } from "@alumis/observables/src/Observable";
import { CancellationToken } from "@alumis/utils/src/CancellationToken";
import { navigatorOnLine } from "@alumis/observables/src/navigatorOnLine";
import { whenAsync } from "@alumis/observables/src/whenAsync";
import { delayAsync } from "@alumis/utils/src/delayAsync";
import { OperationCancelledError } from "@alumis/utils/src/OperationCancelledError";
import { Semaphore } from "@alumis/utils/src/Semaphore";

export class SignalRServer implements SignalServer {

    constructor(url: string) {
        this.hubConnection = new signalR.HubConnectionBuilder().withUrl(url).withHubProtocol(new signalRMsgPack.MessagePackHubProtocol()).build();
    }

    protected hubConnection: signalR.HubConnection;

    state = o(ConnectionState.Disconnected);
    error = o(null);

    private _connectPromise: Promise<void>;
    private _connectCancellationToken: CancellationToken;

    connectAsync() {
        if (this._connectPromise)
            return this._connectPromise;
        this._connectCancellationToken = new CancellationToken();
        let semaphore = new Semaphore();
        semaphore.waitOneAsync();
        let self = this;

        function atomicallySetConnectionStateAndConnectionError(state: ConnectionState, error) {
            let oldConnectionError = self.error.wrappedValue;
            self.error.wrappedValue = error;
            self.state.value = state;
            self.error.wrappedValue = oldConnectionError;
            self.error.value = error;
        }
        
        this._connectPromise = (async () => {
            await semaphore.waitOneAsync();
            function throwIfCancellationRequested() {
                if (self._connectCancellationToken.isCancellationRequested) {
                    delete self._connectPromise;
                    delete self._connectCancellationToken;
                    self.state.value = ConnectionState.Disconnected;
                    throw new OperationCancelledError();
                }
            }

            throwIfCancellationRequested();

            function orThrowOtherError(error) {
                delete self._connectPromise;
                delete self._connectCancellationToken;
                self.state.value = ConnectionState.Disconnected;
                throw error;
            }

            for (let sleep = 0; ;) {
                try {
                    await self.hubConnection.start();
                }
                catch (e) {
                    if (navigatorOnLine.value === false) {
                        atomicallySetConnectionStateAndConnectionError(ConnectionState.ConnectingWaitingForInternet, e);
                        console.warn("Failed to connect to hub. Waiting for internet\u2026");
                        try { await whenAsync(() => navigatorOnLine.value !== false, self._connectCancellationToken); }
                        catch (e) {
                            throwIfCancellationRequested();
                            orThrowOtherError(e);
                        }
                        sleep = 0;
                    }
                    else {
                        atomicallySetConnectionStateAndConnectionError(ConnectionState.ConnectingWaitingToRetry, e);
                        console.error("Failed to connect to hub:", e);
                        try { await delayAsync(sleep = decorrelatedJitter(sleep), self._connectCancellationToken); }
                        catch (e) {
                            throwIfCancellationRequested();
                            orThrowOtherError(e);
                        }
                    }
                    self.state.value = ConnectionState.Connecting;
                    continue;
                }
                if (self._connectCancellationToken.isCancellationRequested) {
                    try { await self.hubConnection.stop(); }
                    catch (e) { console.warn("Failed to stop hub connection:", e); }
                    delete self._connectPromise;
                    delete self._connectCancellationToken;
                    self.state.value = ConnectionState.Disconnected;
                    throw new OperationCancelledError();
                }
                break;
            }
            atomicallySetConnectionStateAndConnectionError(ConnectionState.Connected, null);

            async function disconnectListener() {
                self.hubConnection["closedCallbacks"] = []; // TODO
                try { await self.hubConnection.stop(); }
                catch (e) { console.warn("Failed to stop hub connection:", e); }
                delete self._connectPromise;
                delete self._connectCancellationToken;
                self.state.value = ConnectionState.Disconnected;
            }

            self._connectCancellationToken.addListener(disconnectListener);

            function installOncloseListener() {
                self.hubConnection.onclose(async e => {
                    self._connectCancellationToken.removeListener(disconnectListener);
                    self.hubConnection["closedCallbacks"] = []; // TODO
                    function shouldReturnIfCancellationRequested() {
                        if (self._connectCancellationToken.isCancellationRequested) {
                            delete self._connectPromise;
                            delete self._connectCancellationToken;
                            self.state.value = ConnectionState.Disconnected;
                            return true;
                        }
                        return false;
                    }
                    for (let sleep = 0; ;) {
                        try {
                            await self.hubConnection.start();
                        }
                        catch (e) {
                            if (navigatorOnLine.value === false) {
                                atomicallySetConnectionStateAndConnectionError(ConnectionState.ReconnectingWaitingForInternet, e);
                                console.warn("Failed to reconnect to hub. Waiting for internet\u2026");
                                try { await whenAsync(() => navigatorOnLine.value !== false, self._connectCancellationToken); }
                                catch (e) {
                                    if (shouldReturnIfCancellationRequested())
                                        return;
                                    orThrowOtherError(e);
                                }
                                sleep = 0;
                            }
                            else {
                                atomicallySetConnectionStateAndConnectionError(ConnectionState.ReconnectingWaitingToRetry, e);
                                console.error("Failed to reconnect to hub:", e);
                                try { await delayAsync(sleep = decorrelatedJitter(sleep), self._connectCancellationToken); }
                                catch (e) {
                                    if (shouldReturnIfCancellationRequested())
                                        return;
                                    orThrowOtherError(e);
                                }
                            }
                            self.state.value = ConnectionState.Connecting;
                            continue;
                        }
                        if (self._connectCancellationToken.isCancellationRequested) {
                            try { await self.hubConnection.stop(); }
                            catch (e) { console.warn("Failed to stop hub connection:", e); }
                            delete self._connectPromise;
                            delete self._connectCancellationToken;
                            self.state.value = ConnectionState.Disconnected;
                            return;
                        }
                        break;
                    }
                    atomicallySetConnectionStateAndConnectionError(ConnectionState.Connected, null);
                    self._connectCancellationToken.addListener(disconnectListener);
                    installOncloseListener();
                });
            }
            installOncloseListener();
        })();
        atomicallySetConnectionStateAndConnectionError(ConnectionState.Connecting, null);
        semaphore.release();
        return this._connectPromise;
    }

    disconnect() {
        if (this._connectCancellationToken)
            this._connectCancellationToken.cancel();
    }
}

// Exponential backoff
// Based on the ideas of Marc Brooker: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
// https://en.wikipedia.org/wiki/Exponential_backoff

function decorrelatedJitter(sleep: number) {
    return Math.min(60000, random(5000, sleep * 3));
}

function random(min: number, max: number) {
    return Math.floor(Math.random() * (max - min)) + min;
}