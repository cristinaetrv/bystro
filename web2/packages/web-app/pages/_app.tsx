import App from "next/app";
import Header from "../components/Header/Header";
import { initIdTokenHandler } from "../libs/auth";

import { init as initJobTracker } from "../libs/jobTracker/jobTracker";
import { addAuthCallbacks as socketIOAuthCallbacks } from "../libs/socketio";

import "animate.css";
import "normalize.css";
import "../styles/main.scss";
import "../styles/defaultView.scss"
import "../styles/header.scss";
import "../styles/pages/index.scss";
import "../styles/card.scss";
import "../styles/pages/public.scss";
import "../styles/pages/results.scss";
import "../styles/card.scss";
import "../styles/pages/public.scss";

declare type props = {
  Component: any;
  ctx: any;
};

export default class MyApp extends App<props> {
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
        </span>
      </span>
    );
  }
}
