// TODO: Make this a library
import jwtDecode from "jwt-decode";
import Callbacks from "./callbacks";

import getConfig from "next/config";
const url = getConfig().publicRuntimeConfig.API.BASE_URL || "/api";
const refreshUrl = `${url}/user/auth/refresh`;

export const loggedInEventName = "loggedIn";
export const loggedOutEventName = "loggedOut";

const callbacks = new Callbacks({
  [loggedInEventName]: [],
  [loggedOutEventName]: []
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
  setTokenFromJSON(token: { [token_name: string]: string }): void;
}

export type TokenType = {
  name: string;
  email: string;
  exp: number;
  iat: number;
  role: string;
};

class Tokens implements TokenInterface {
  name: string;
  decodedToken?: TokenType;
  token?: string;
  refreshTime: number;
  intervalPromise?: NodeJS.Timeout;
  refreshPromise?: Promise<void>;

  constructor(name: string) {
    this.name = name;
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
      return true;
    }

    return new Date().getTime() / 1000 > this.decodedToken.exp;
  }

  setTokenFromJSON = async token => {
    if (!token[this.name]) {
      throw new Error(`Token JSON must contain ${this.name}`);
    }

    window.localStorage.setItem(this.name, token[this.name]);
    const decoded: TokenType = jwtDecode(token[this.name]);

    this.decodedToken = decoded;
    this.token = token[this.name];
    const data = [this.decodedToken, this.token];

    callbacks.call(loggedInEventName, data);
  };

  clearToken() {
    window.localStorage.removeItem(this.name);
    this.token = null;
    this.decodedToken = null;

    this.cancelMaintainIdToken();
  }

  private maintainIdToken(successCb = _ => {}, failureCb = _ => {}) {
    this.cancelMaintainIdToken();
    this.refreshIdTokenAsync()
      .then(res => successCb(res))
      .catch(err => failureCb(err));

    this.intervalPromise = setInterval(
      () =>
        this.refreshIdTokenAsync()
          .then(res => successCb(res))
          .catch(err => failureCb(err)),
      this.refreshTime
    );
  }

  cancelMaintainIdToken() {
    if (this.intervalPromise) {
      this.intervalPromise = null;
    }
  }

  async refreshIdTokenAsync() {
    await fetch(refreshUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    }).then(res => {
      if (res.status >= 300) {
        if (res.status === 401) {
          this.logout();
        }
        throw new Error(res.statusText);
      }

      return res.json().then(data => {
        return this.setTokenFromJSON(data);
      });
    });

    return [this.decodedToken, this.token];
  }
}

const singleton = {};

export function getTokenHandler(name: string): Tokens {
  if (typeof window === "undefined") {
    return null;
  }

  if (singleton[name]) {
    return singleton[name];
  }

  singleton[name] = new Tokens(name);

  return singleton[name];
}

export function initIdTokenHandler() {
  if (typeof window === "undefined") {
    console.info("server side");
    return null;
  }

  return getTokenHandler("id_token");
}
