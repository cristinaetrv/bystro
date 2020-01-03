import App from "next/app";
import Header from "../components/Header/Header";
// import { initialize, isAuthenticated, initStateSSR } from "../libs/auth0-auth";
import { initIdTokenHandler } from "../libs/auth";
import Router from "next/router";
import jscookies from "js-cookie";
import "animate.css";
import "normalize.css";
import "styles/main.scss";

import { init as initJobTracker } from "../libs/jobTracker/jobTracker";
import { listen as socketIOlisten } from "../libs/socketio";

// import CssBaseline from '@material-ui/core/CssBaseline';

// import {
//   Notebook,
//   startRequest,
//   startListener
// } from '../components/Notebook/datastore';

// TODO: think about order of initialization of auth module
// TODO: set some kind of protected property on routes, instead of
// blacklisting here
const protectedRoute: any = {
  // '/notebook': true
};

const isServer = typeof window === "undefined";

let NodeCookies: any;
if (isServer) {
  NodeCookies = require("cookies");
}

declare type props = {
  Component: any;
  ctx: any;
};
// let authInitialized = false;
// TODO: think about using React context to pass down auth state instead of prop
export default class MyApp extends App<props> {
  // Constructor runs before getInitialProps
  constructor(props: any) {
    super(props);

    if (!isServer) {
      // This must happen first, so that child components that use auth
      // in constructor may do so
      // initialize();
      // if (isAuthenticated() && !Notebook.initialized) {
      //   startRequest().then(() => startListener());
      // }
    }
  }

  // This runs:
  // 1) SSR Mode: One time
  // 2) Client mode: After constructor (on client-side route transitions)

  static async getInitialProps({ Component, ctx }: props) {
    let pageProps: any = {};

    if (isServer) {
      // Run here because we have no access to ctx in constructor
      // initStateSSR(ctx.req.headers.cookie);
    }

    if (protectedRoute[ctx.pathname] === true) {
      // ctx only exists only on server
      if (ctx.res) {
        const cookies = new NodeCookies(ctx.req, ctx.res);
        cookies.set("referrer", ctx.pathname);

        ctx.res.writeHead(303, { Location: "/login?redirect=true" });
        ctx.res.end();

        return { pageProps };
      }

      jscookies.set("referrer", ctx.pathname);
      Router.replace(`/login?redirect=true`);

      return { pageProps };
    }

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx);
    }

    return { pageProps };
  }

  componentDidMount() {
    initIdTokenHandler();
    initJobTracker();
    socketIOlisten();
  }

  render() {
    const { Component, pageProps } = this.props;

    return (
      <span id="theme-site">
        <Header />
        <span id="main">
          <Component {...pageProps} />
          {/* <ACard /> */}
        </span>
      </span>
    );
  }
}
