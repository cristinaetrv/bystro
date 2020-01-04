import { PureComponent, createRef } from "react";
import "../styles/pages/login.scss";
import "../styles/card.scss";
import "isomorphic-unfetch";
import { initIdTokenHandler, TokenInterface } from "../libs/auth";
import Router from "next/router";

import getConfig from "next/config";

const url = getConfig().publicRuntimeConfig.API.BASE_URL;
// import { Formik } from 'formik';

declare type state = {
  loggedIn?: boolean;
  failed?: boolean;
  email?: any;
  password?: any;
};

interface LoginProps {
  redirected: boolean;
}

class Login extends PureComponent<LoginProps> {
  state: state = {
    email: createRef(),
    password: createRef()
  };

  constructor(props: any) {
    super(props);
  }

  onLoginButtonClick = async (email, password) => {
    const tokenHandler: TokenInterface = initIdTokenHandler();

    fetch(`${url}/user/auth/local`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    })
      .then(r => r.json())
      .then(data => {
        tokenHandler.setTokenFromJSON(data);
        Router.push("/");
      })
      .catch(e => {
        console.info(e.message);
        console.info("failed to fetch", e.message);
      });
  };

  onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      password: e.target.value
    });
  };

  handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    this.onLoginButtonClick(
      this.state.email.current.value,
      this.state.password.current.value
    );
  };

  render() {
    return (
      <div id="login-page" className="centered">
        <div className="card shadow1">
          <div className="header">
            <h2>Log In</h2>
          </div>
          <form className="content" onSubmit={this.handleSubmit}>
            <div className="input-container">
              <input type="text" placeholder="email" ref={this.state.email} />
            </div>
            <div className="input-container">
              <input
                type="password"
                placeholder="password"
                ref={this.state.password}
              />
            </div>
            <div className="action row center">
              <button>Log In</button>
              <a href="#" style={{ marginLeft: "1rem" }}>
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default Login;
