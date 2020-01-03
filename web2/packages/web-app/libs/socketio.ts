// FIXME: Replace with lighter-weight alternative
import io from "socket.io-client";
import {
  initIdTokenHandler,
  loggedInEventName,
  loggedOutEventName,
  addCallback as addAuthCallback
} from "./auth";
import Callbacks from "./callbacks";
import getConfig from "next/config";

const secure = !getConfig().DEVELOPMENT;

export const events = {
  connected: "connected",
  disconnected: "disconnected"
};

let socket = null;

let refreshTimeout = null;
let connectTimeout: NodeJS.Timeout = null;
let authAttempts = 0;

const callbacks = new Callbacks({
  connected: [],
  disconnected: []
});

export function addCallback(
  type: string,
  action: (socket: any) => void
): number {
  const id = callbacks.add(type, action);

  if (socket) {
    action(socket);
  }

  return id;
}

export const removeCallback = callbacks.remove;

export function listen() {
  addAuthCallback(loggedInEventName, () => {
    console.info("auth loggedIn event in libs/socket-io");
    _connect();
  });

  addAuthCallback(loggedOutEventName, () => {
    console.info(`received ${loggedOutEventName} in socketio`);
    if (socket && socket.connected) {
      _logout(socket);
    } else {
      clearTimeout(refreshTimeout);
    }
  });
}

function _clearAuthAttempts() {
  authAttempts = 0;
  if (refreshTimeout) {
    //$timeout.flush(refreshTimeout);
    clearTimeout(refreshTimeout);
  }
}

function _logout(socket) {
  if (connectTimeout !== null) {
    clearTimeout(connectTimeout);
  }

  connectTimeout = setTimeout(() => {
    socket.disconnect(); //calls remove all listeners
    socket.removeAllListeners();

    socket.connected = false;
    //this.authenticated = true;

    _clearAuthAttempts();
    callbacks.call(events.disconnected);
  }, 0);
}

function _connect() {
  if (connectTimeout) {
    clearTimeout(connectTimeout);
  }

  connectTimeout = setTimeout(
    () => {
      if (socket && socket.connected) {
        _logout(socket);
      }

      socket = _newConnection();
      return socket;
      // return $q.resolve(socketIO.socket);
    },
    0,
    false
  );
}

/* @private*/

function _newConnection() {
  socket = io(window.location.protocol + "//" + window.location.host, {
    secure
  });

  console.info("socketIO", socket);

  socket.connected = true;

  _clearAuthAttempts();
  _createAuthListener(socket);

  return socket;
}

// TODO: consider merits of just using Auth.token directly,
// to avoid needing to tear down the listeners
async function _createAuthListener(socket) {
  socket.on("connect", () => {
    const auth = initIdTokenHandler();
    _authenticate(socket, auth.getToken());
  });

  socket.on("reconnect_failed", () => {
    _logout(socket);
  });

  socket.on("unauthorized", () => {
    if (authAttempts > 5) {
      _logout(socket);
      return;
    }

    if (refreshTimeout) {
      return;
    }

    const auth = initIdTokenHandler();

    auth
      .refreshIdTokenAsync()
      .then(([_, idToken]) => {
        console.info(
          "calling authenticate after userTokens.refreshIdTokenAsync in services.socketIO.js",
          idToken
        );
        _authenticate(socket, idToken);
      })
      .catch(() => {
        refreshTimeout = setTimeout(
          socket => {
            _authenticate(socket, auth.getToken());
            refreshTimeout = null;
          },
          5000,
          socket
        );
      });
  });

  socket.on("authenticated", function() {
    //not forwarding because I want to expose the socket
    callbacks.call(events.connected, socket);
    _clearAuthAttempts();
  });
}

function _authenticate(socket, idToken) {
  ++authAttempts;
  socket.emit("authenticate", { token: idToken });
}
