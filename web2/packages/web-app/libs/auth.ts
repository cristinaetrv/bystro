import jwtDecode from 'jwt-decode';
import 'isomorphic-unfetch';
import Callbacks from "./callbacks";

import getConfig from "next/config";
const url = getConfig().publicRuntimeConfig.API.BASE_URL;
const refreshUrl = `${url}/user/auth/refresh`;

export const loggedInEventName = 'loggedIn';
export const loggedOutEventName = 'loggedOut';

const callbacks = new Callbacks({
    [loggedInEventName]: [],
    [loggedOutEventName]: [],
});

export const addCallback = callbacks.add;
export const removeCallback = callbacks.remove;

export interface TokenInterface {
    name: string;
    decodedToken?: TokenType;
    token?: string;
    refreshTime: number;
    intervalPromise?: NodeJS.Timeout;
    refreshPromise?: Promise<void>;

    logout(): void;
    getToken(): any;
    refreshIdTokenAsync(): Promise<(string | TokenType)[]>;
    setTokenFromJSON(token: {
        [token_name: string]: string
    }): void;
}

export type TokenType = {
    name: string;
    email: string;
    exp: number;
    iat: number;
    role: string;
}

class Tokens implements TokenInterface {
    name: string;
    decodedToken?: TokenType;
    token?: string;
    refreshTime: number;
    intervalPromise?: NodeJS.Timeout;
    refreshPromise?: Promise<void>;

    constructor(name: string) {
        this.name = name
        this.intervalPromise = null;
        this.refreshTime = 30 * 60 * 1000; // 30mim
        this.refreshPromise = null;

        const token = window.localStorage.getItem(this.name);

        if (token) {
            this.decodedToken = jwtDecode(token);
            this.token = token;

            if (this.decodedToken && !this.tokenIsExpired()) {
                this.maintainIdToken();
            } else {
                this.decodedToken = null;
                this.token = null;
            }
        }
    }

    logout() {
        this.clearToken();
        callbacks.call(loggedOutEventName, null);
    }

    getToken() {
        return this.token;
    }

    tokenIsExpired() {
        if (!this.decodedToken) {
            return true
        }

        return new Date().getTime() / 1000 > this.decodedToken.exp;
    }

    setTokenFromJSON = (token) => {
        if (!token[this.name]) {
            console.error(`Token JSON must contain ${this.name}`);
            return;
        }

        try {
            window.localStorage.setItem(this.name, token[this.name]);
            const decoded: TokenType = jwtDecode(token[this.name]);

            this.decodedToken = decoded;
            this.token = token[this.name];
            console.info("setting");
            callbacks.call(loggedInEventName, [this.decodedToken, this.token]);
        } catch (e) {
            console.error(e);
        }
    }

    clearToken() {
        window.localStorage.removeItem(this.name);
        this.token = null;
        this.decodedToken = null;

        this.cancelMaintainIdToken();
    }

    maintainIdToken(successCb = (_) => { }, failureCb = (_) => { }) {
        this.cancelMaintainIdToken();
        this.refreshIdTokenAsync().then(res => successCb(res)).catch(err => failureCb(err))

        this.intervalPromise = setInterval(
            () => this.refreshIdTokenAsync().then(res => successCb(res)).catch(err => failureCb(err))
            , this.refreshTime
        );
    }

    cancelMaintainIdToken() {
        if (this.intervalPromise) {
            this.intervalPromise = null;
        }
    }

    async refreshIdTokenAsync() {
        try {
            const response = await fetch(refreshUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    [this.name]: this.token
                })
            }).then(j => j.json());

            if (!response) {
                throw new Error('response missing in refreshIdTokenAsync');
            }

            this.setTokenFromJSON(response);

            return [this.decodedToken, this.token];
        } catch (e) {
            console.error(e)
            return null;
        };
    }
}

const singleton = {};

export function getTokenHandler(name: string): Tokens {
    if (typeof window === 'undefined') {
        return null;
    }

    if (singleton[name]) {
        return singleton[name];
    }

    singleton[name] = new Tokens(name);

    return singleton[name];
}

export function initIdTokenHandler() {
    if (typeof window === 'undefined') {
        return null;
    }

    return getTokenHandler('id_token');
}