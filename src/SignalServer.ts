import { r } from "@alumis/observables-i18n";
import { Observable } from "@alumis/observables";

export interface SignalServer {
    connectAsync(): Promise<void>;
    disconnect(): void;
    state: Observable<ConnectionState>;
    error: Observable<any>;
}

export enum ConnectionState {
    Disconnected,
    Connecting,
    ConnectingWaitingForInternet,
    ConnectingWaitingToRetry,
    Connected,
    Reconnecting,
    ReconnectingWaitingForInternet,
    ReconnectingWaitingToRetry
}

export function connectionStateToString(connectionState: ConnectionState) {
    switch (connectionState) {
        case ConnectionState.Disconnected:
            /// <i18n key="disconnected" lang="en">disconnected</i18n>
            /// <i18n key="disconnected" lang="no">frakoblet</i18n>
            return r("disconnected").value;
        case ConnectionState.Connecting:
            /// <i18n key="connecting" lang="en">connecting</i18n>
            /// <i18n key="connecting" lang="no">kobler til</i18n>
            return r("connecting").value;
        case ConnectionState.ConnectingWaitingForInternet:
            /// <i18n key="connectingWaitingForInternet" lang="en">connecting (waiting for internet connection)</i18n>
            /// <i18n key="connectingWaitingForInternet" lang="no">kobler til (venter på internettilkobling)</i18n>
            return r("connectingWaitingForInternet").value;
        case ConnectionState.ConnectingWaitingToRetry:
            /// <i18n key="connectingWaitingToRetry" lang="en">waiting a few moments before trying to connect again</i18n>
            /// <i18n key="connectingWaitingToRetry" lang="no">venter litt før det gjøres et nytt forsøk på å koble til</i18n>
            return r("connectingWaitingToRetry").value;
        case ConnectionState.Connected:
            /// <i18n key="connected" lang="en">connected</i18n>
            /// <i18n key="connected" lang="no">tilkoblet</i18n>
            return r("connected").value;
        case ConnectionState.Reconnecting:
            /// <i18n key="reconnecting" lang="en">reconnecting</i18n>
            /// <i18n key="reconnecting" lang="no">gjenoppretter tilkobling</i18n>
            return r("reconnecting").value;
        case ConnectionState.ReconnectingWaitingForInternet:
            /// <i18n key="reconnectingWaitingForInternet" lang="en">reconnecting (waiting for internet connection)</i18n>
            /// <i18n key="reconnectingWaitingForInternet" lang="no">gjenoppretter tilkobling (venter på internettilkobling)</i18n>
            return r("reconnectingWaitingForInternet").value;
        case ConnectionState.ReconnectingWaitingToRetry:
            /// <i18n key="reconnectingWaitingToRetry" lang="en">waiting a few moments before trying to reconnect</i18n>
            /// <i18n key="reconnectingWaitingToRetry" lang="no">venter litt før det gjøres et nytt forsøk på å gjenopprette tilkoblingen</i18n>
            return r("reconnectingWaitingToRetry").value;
    }
}