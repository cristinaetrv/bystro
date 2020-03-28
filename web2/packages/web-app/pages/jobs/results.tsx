import { PureComponent } from "react";
import {
  removeCallback,
  JobType,
  addCallback
} from "../../libs/jobTracker/jobTracker";

import Fuse from "fuse.js";
import Link from "next/link";

declare type state = {
  jobsSelected: [number, number];
  jobType: string;
  jobs: JobType[];
  searchText: string;
  filteredJobs: JobType[];
};

class Jobs extends PureComponent {
  state: state = {
    jobType: null,
    jobsSelected: [-1, -1],
    jobs: [],
    searchText: "",
    filteredJobs: []
  };

  _callbackId?: number = null;

  fuse?: any = null;

  static async getInitialProps({ query }: any) {
    return {
      type: query.type
    };
  }

  constructor(props: any) {
    super(props);
  }

  handleChange = selectedOption => {
    this.setState({ selectedOption });
  };

  componentWillUnmount() {
    removeCallback((this.props as any).type, this._callbackId);
  }

  componentDidMount() {
    const type = (this.props as any).type;
    this._callbackId = addCallback(type, (jobs: JobType[]) => {
      if (this.state.jobs != jobs) {
        this.setState(() => ({
          jobs,
          filteredJobs: jobs
        }));

        this.fuse = new Fuse(jobs, {
          shouldSort: true,
          threshold: 0,
          location: 0,
          distance: 10,
          maxPatternLength: 32,
          minMatchCharLength: 1,
          tokenize: true,
          // matchAllTokens: true,
          findAllMatches: true,
          keys: [
            "name",
            "inputFileName",
            "createdAt",
            "submittedDate",
            "assembly",
            "type",
            "log.progress",
            "visibility"
          ]
        });
      }
    });
  }

  handleClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    idx: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!e.shiftKey) {
      // Router.push(
      //   `/jobs/results/${this.state.filteredJobs[idx]._id}`,
      //   (shallow = true)
      // );
      return;
    }

    let [min, max] = this.state.jobsSelected;

    if (idx > min) {
      max = idx;
      if (min == -1) {
        min = 0;
      }
    } else if (idx == min) {
      min = idx;
      max = idx;
    } else if (idx > min) {
      max = idx;
    } else if (min == -1) {
      min = 0;
    } else {
      min = idx;
    }

    this.setState(() => ({
      jobsSelected: [min, max]
    }));
  };

  filterList = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.fuse) {
      const input = e.target.value;

      if (!input) {
        this.setState((old: state) => ({
          filteredJobs: old.jobs,
          jobsSelected: [-1, -1]
        }));

        return;
      }

      const res = this.fuse.search(input);

      this.setState(() => ({
        filteredJobs: res,
        jobsSelected: [-1, -1]
      }));
    }
  };

  render() {
    return (
      <div id="public-page">
        {/* <div id='click-handler' onClick={(e) => this.handleClick(e, -1)} style={{ width: '100%' }}></div> */}

        <span id="right-list" className="list">
          <span id="control-center">
            <input
              id="public-search"
              className="outlined"
              type="text"
              placeholder="Search results"
              onChange={e => this.filterList(e)}
            />
            {/* <button id='delete' className='icon-button red' disabled={this.state.jobsSelected[0] === -1}>
                            <i className='material-icons left'>
                                delete_outline
                        </i>
                        </button> */}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "1.5rem"
            }}
          >
            <button
              id="delete"
              className="icon-button red"
              disabled={this.state.jobsSelected[0] === -1}
            >
              <i className="material-icons left">delete_outline</i>
            </button>
            <div style={{ marginLeft: ".75rem" }}>
              {this.state.jobsSelected[0] === -1
                ? 0
                : this.state.jobsSelected[1] == this.state.jobsSelected[0]
                ? 1
                : this.state.jobsSelected[1] -
                  this.state.jobsSelected[0] +
                  1}{" "}
              selected
            </div>
          </span>
          <span className="job-list">
            {this.state.filteredJobs.map((job, idx) => (
              <Link href={`/jobs/view?id=${job._id}`}>
                <a
                  key={idx}
                  className={`card clickable shadow1 ${
                    idx >= this.state.jobsSelected[0] &&
                    idx <= this.state.jobsSelected[1]
                      ? "selected"
                      : ""
                  }`}
                  // onClick={e => this.handleClick(e, idx)}
                >
                  <h5>{job.name}</h5>
                  <div className="content">
                    <div className="row">
                      <span className="left">Created on:</span>
                      <b className="right">{job.createdAt}</b>
                    </div>
                    <div className="row">
                      <span className="left">Assembly</span>
                      <b className="right">{job.assembly}</b>
                    </div>
                    <div className="row">
                      <span className="left">
                        {job.type == "annotation" ? "Input:" : "Query:"}
                      </span>
                      <b className="right">
                        {job.type == "annotation" ? (
                          <a href={job.inputFileName}>{job.inputFileName}</a>
                        ) : (
                          "Some query"
                        )}
                      </b>
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </span>
        </span>
      </div>
    );
  }
}

export default Jobs;
