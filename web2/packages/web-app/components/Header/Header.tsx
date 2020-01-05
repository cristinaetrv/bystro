import { PureComponent, Fragment, memo } from "react";
import Link from "next/link";
import HLink from "./Link";

import {
  initIdTokenHandler,
  addCallback,
  removeCallback,
  loggedInEventName,
  loggedOutEventName
} from "../../libs/auth";
import "./header.scss";
import Router, { withRouter } from "next/router";
import { WithRouterProps } from "next/dist/client/with-router";

// let listenerID: number;

declare type headerState = {
  // showProfileControls: boolean,
  isLoggedIn: boolean;
  user?: any;
};

const UserHeader = memo(
  (props: any) => {
    if (props.user) {
      return (
        <Fragment>
          <Link href="/user">
            <a className={`${props.pathname === "/user" ? "active" : ""}`}>
              <b>{props.user!.name}</b>
            </a>
          </Link>
          <button onClick={props.onLogout}>Log out</button>
        </Fragment>
      );
    }
    return (
      <Link href="/login">
        <a className={`${props.pathname === "/login" ? "active" : ""}`}>
          Login
        </a>
      </Link>
    );
  },
  (prevProps, nextProps) => {
    if (
      prevProps.user !== nextProps.user ||
      prevProps.pathname !== nextProps.pathname ||
      prevProps.pathname === "/login" ||
      nextProps.pathname === "/login" ||
      prevProps.pathname === "/user" ||
      nextProps.pathname === "/user"
    ) {
      return false;
    }

    return true;
  }
);

let _loggedInCallbackId = null;
let _loggedOutCallbackId = null;
class Header extends PureComponent<WithRouterProps> {
  state: headerState = {
    // showProfileControls: false,
    isLoggedIn: false,
    user: null
  };

  onProfileHover = () => {
    this.setState({
      showProfileControls: true
    });
  };

  onProfileLeave = () => {
    this.setState({
      showProfileControls: false
    });
  };

  onLogout() {
    const handler = initIdTokenHandler();

    handler.logout();
    Router.push("/");
  }

  constructor(props: any) {
    super(props);

    // this.state.isLoggedIn = isAuthenticated();
  }

  componentDidMount() {
    const handler = initIdTokenHandler();
    this.setState({
      user: handler.decodedToken
    });

    _loggedInCallbackId = addCallback(loggedInEventName, data => {
      this.setState({
        user: data[0]
      });
    });

    _loggedOutCallbackId = addCallback(loggedOutEventName, () => {
      this.setState({
        user: null
      });
    });
  }

  componentWillUnmount() {
    // removeListener(listenerID);
    removeCallback(loggedInEventName, _loggedInCallbackId);
    removeCallback(loggedOutEventName, _loggedOutCallbackId);
  }

  render() {
    // TODO: Figure out why typing information not being read
    const {
      router: { pathname }
    } = this.props as any;
    // interestingly, for initial page load, using this.state.isLoggedIn within the template
    // actually may result in a flash of incorrect state
    // const loggedIn = this.state.isLoggedIn;

    return (
      <span id="header">
        <HLink href="/" title="/" pathname={pathname} active="/" />
        <HLink
          href="/jobs/results?type=completed"
          title="Results"
          pathname={pathname}
          active="/jobs/results"
        />
        <HLink
          href="/jobs/public?type=public"
          title="Public"
          pathname={pathname}
          active="/jobs/public"
        />
        {/* <Link href="/share">
          <a
            className={`home ${bStyle} ${
              pathname.startsWith("/share") ? "active" : ""
            }`}
          >
            Share
          </a>
        </Link> */}

        <span id="profile-divider" />
        <UserHeader
          user={this.state.user}
          onLogout={this.onLogout}
          pathname={pathname}
        />
      </span>
    );
  }
}

export default withRouter(Header);
