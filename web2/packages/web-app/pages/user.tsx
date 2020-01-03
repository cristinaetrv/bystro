import { PureComponent } from "react";
// import auth from '../libs/auth0-auth';
import { initIdTokenHandler } from "../libs/auth";

import "styles/pages/user.scss";

class UserProfile extends PureComponent {
  state: any = {
    loggedIn: true,
    name: ""
  };

  constructor(props: any) {
    super(props);
  }

  componentDidMount = () => {
    const handler = initIdTokenHandler();

    const token = handler.decodedToken;

    this.setState({
      name: token.name
    });
  };

  shouldComponentUpdate(_: any, state: any) {
    return this.state.name !== state.name;
  }

  render() {
    return (
      <div id="user" className="centered">
        <span
          style={{
            flexDirection: "row",
            display: "flex",
            alignItems: "center"
          }}
        >
          {/* <img
            src='#'
            width="50"
            height="50"
            style={{ marginRight: 14 }}
          /> */}
          <h3>{this.state.name}</h3>
        </span>
      </div>
    );
  }
}

export default UserProfile;
