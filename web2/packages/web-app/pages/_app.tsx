import App from "next/app";
import Header from "../components/Header/Header";
import { initIdTokenHandler } from "../libs/auth";
import "animate.css";
import "normalize.css";
import "styles/main.scss";

import { init as initJobTracker } from "../libs/jobTracker/jobTracker";
import { addAuthCallbacks as socketIOAuthCallbacks } from "../libs/socketio";

// const isServer = typeof window === "undefined";

// let NodeCookies: any;
// if (isServer) {
//   NodeCookies = require("cookies");
// }

declare type props = {
  Component: any;
  ctx: any;
};
// let authInitialized = false;
// TODO: think about using React context to pass down auth state instead of prop
export default class MyApp extends App<props> {
  // This runs:
  // 1) SSR Mode: One time
  // 2) Client mode: After constructor (on client-side route transitions)

  // static async getInitialProps({ Component, ctx }: props) {
  //   let pageProps: any = {};

  //   if (isServer) {
  //     // Run here because we have no access to ctx in constructor
  //     // initStateSSR(ctx.req.headers.cookie);
  //   }

  //   if (protectedRoute[ctx.pathname] === true) {
  //     // ctx only exists only on server
  //     if (ctx.res) {
  //       const cookies = new NodeCookies(ctx.req, ctx.res);
  //       cookies.set("referrer", ctx.pathname);

  //       ctx.res.writeHead(303, { Location: "/login?redirect=true" });
  //       ctx.res.end();

  //       return { pageProps };
  //     }

  //     jscookies.set("referrer", ctx.pathname);
  //     Router.replace(`/login?redirect=true`);

  //     return { pageProps };
  //   }

  //   if (Component.getInitialProps) {
  //     pageProps = await Component.getInitialProps(ctx);
  //   }

  //   return { pageProps };
  // }

  componentDidMount() {
    initJobTracker();
    socketIOAuthCallbacks();
    initIdTokenHandler();
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
