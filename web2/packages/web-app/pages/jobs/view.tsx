// import { PureComponent } from "react";
// import "./job-id-page.scss";
// import fetch from "isomorphic-unfetch";
import config from "next/config";
const url = config().publicRuntimeConfig.API.BASE_URL;
import { useRouter } from "next/router";
// function Menu() {
//   return <div id="menu">Hello</div>;
// }

// class Jobs extends PureComponent {
//   static async getInitialProps({ query }) {
//     const id = query.id;

//     return {id};
//   }

//   componentDidMount() {
//     await fetch(`${url}/jobs/${this.props.id}`, {
//         headers: {
//             "Authorization": "Bearer"
//         }
//     })
//   }
//   onDelete = () => {};

//   render() {
//     return (
//       <div id="job-id-page" style={{ width: "100%" }}>
//         <div className="card shadow1" style={{ width: "100%" }}>
//           <div className="header">Test</div>
//         </div>
//       </div>
//     );
//   }
// }

// export default Jobs;

// This page doesn't define `getInitialProps`.
// Next.js will export the page to HTML at build time with the loading state
// When the page is loaded in the browser SWR will fetch the data
// Using the defined fetcher function
// import fetch from "unfetch";
import useSWR from "swr";
import { initIdTokenHandler } from "../../libs/auth";
import "../../styles/pages/view.scss";

function IndexRow({ search }) {
  if (search.activeSubmission && search.activeSubmission.state === "started") {
    const totalProgress =
      search.activeSubmission.log.progress +
      search.activeSubmission.log.skipped;

    if (totalProgress == 0) {
      return search.activeSubmission.log.messages[
        search.activeSubmission.log.messages.length - 1
      ];
    }

    return totalProgress + " lines indexed for search";
  }

  return search.activeSubmission.log.messages[
    search.activeSubmission.log.messages.length - 1
  ];
}

async function fetcher(path, token) {
  if (!token) {
    return {};
  }

  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const json = await res.json();
  return json;
}

function JobView() {
  const router = useRouter();
  const auth = initIdTokenHandler();

  if (!router.query.id) {
    return <div>loading...</div>;
  }

  const { data, error } = useSWR(
    [`${url}/jobs/${router.query.id}`, auth.token],
    fetcher
  );

  if (error) return <div>failed to load</div>;
  if (!data) return <div>loading...</div>;
  console.info("data", data);
  return (
    <div id="job-view">
      <div className="card shadow1">
        <div id="card-menu">
          <div className="option">Download annotation</div>
          <div className="option">Upload to S3</div>
        </div>
        <div className="content">
          <div className="row">
            <IndexRow search={data.search} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobView;
