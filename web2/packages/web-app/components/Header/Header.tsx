import { PureComponent, Fragment } from "react";
import Link from "next/link";
// import {
//   logout,
//   addListener,
//   removeListener,
//   // isAuthenticated
// } from '../libs/auth0-auth';
import {
  initIdTokenHandler,
  addCallback,
  removeCallback,
  loggedInEventName,
  loggedOutEventName
} from "../libs/auth";
import "./Header/header.scss";
import Router, { withRouter } from "next/router";
import { WithRouterProps } from "next/dist/client/with-router";

const bStyle = "link-button";

// let listenerID: number;

declare type headerState = {
  // showProfileControls: boolean,
  isLoggedIn: boolean;
  user?: any;
};

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
        <Link href="/jobs/results?type=completed" replace>
          <a
            className={`home ${bStyle} ${
              pathname === "/jobs/results" ? "active" : ""
            }`}
          >
            Results
          </a>
        </Link>
        <Link href="/jobs/public?type=public" replace>
          <a
            className={`home ${bStyle} ${
              pathname === "/jobs/public" ? "active" : ""
            }`}
          >
            Public
          </a>
        </Link>
        <Link href="/share">
          <a
            className={`home ${bStyle} ${
              pathname.startsWith("/share") ? "active" : ""
            }`}
          >
            Share
          </a>
        </Link>

        <span id="profile-divider" />
        {this.state.user ? (
          <Fragment>
            <Link href="/user">
              <a className={`${bStyle}`}>
                <b>{this.state.user!.name}</b>
              </a>
            </Link>
            <button className={`${bStyle}`} onClick={this.onLogout}>
              Log out
            </button>
            {/* TODO: Add back in for narrow views
              // <span id="narrow-view" style={{ marginLeft: 'auto' }}>
              //   <span
              //     tabIndex={0}
              //     style={{ outline: 'none' }}
              //     onBlur={this.onProfileLeave}
              //   >
              //     <a className="icon-button" onClick={this.onProfileHover}>
              //       <i className="material-icons">face</i>
              //     </a>
              //     <span>
              //       {this.state.showProfileControls && (
              //         <span id="profile-menu">
              //           <a onClick={this.logout}>Logout</a>
              //         </span>
              //       )}
              //     </span>
              //   </span>
              // </span>
            */}
          </Fragment>
        ) : (
          <Link href="/login">
            <a className={`${bStyle} ${pathname === "/login" ? "active" : ""}`}>
              Login
            </a>
          </Link>
        )}
      </span>
    );
  }
}

export default withRouter(Header);
