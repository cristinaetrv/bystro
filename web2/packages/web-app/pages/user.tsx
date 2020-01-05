import { PureComponent } from "react";
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
          <h3>{this.state.name}</h3>
        </span>
      </div>
    );
  }
}

export default UserProfile;
