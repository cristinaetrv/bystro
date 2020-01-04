import { PureComponent, Fragment, memo } from "react";
import Link from "next/link";
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

const bStyle = "link-button";

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
            <a
              className={`${bStyle} ${
                props.pathname === "/user" ? "active" : ""
              }`}
            >
              <b>{props.user!.name}</b>
            </a>
          </Link>
          <button className={`${bStyle}`} onClick={props.onLogout}>
            Log out
          </button>
        </Fragment>
      );
    }
    return (
      <Link href="/login">
        <a
          className={`${bStyle} ${props.pathname === "/login" ? "active" : ""}`}
        >
          Login
        </a>
      </Link>
    );
  },
  (prevProps, nextProps) => {
    if (
      prevProps.user !== nextProps.user ||
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
        <Link href="/">
          <a className={`home ${bStyle} ${pathname === "/" ? "active" : ""}`}>
            <b>/</b>
          </a>
        </Link>
        <Link href="/jobs/results?type=completed">
          <a
            className={`home ${bStyle} ${
              pathname === "/jobs/results" ? "active" : ""
            }`}
          >
            Results
          </a>
        </Link>
        <Link href="/jobs/public?type=public">
          <a
            className={`home ${bStyle} ${
              pathname === "/jobs/public" ? "active" : ""
            }`}
          >
            Public
          </a>
        </Link>
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
