import React from "react";
import { removeCallback, JobType, addCallback } from "../../libs/jobTracker/jobTracker";
import "styles/card.scss";
import "styles/pages/public.scss";
import Fuse from 'fuse.js';

declare type state = {
  jobSelected?: JobType;
  jobType: string;
  jobs: JobType[];
  searchText: string;
  filteredJobs: JobType[];
};

class Jobs extends React.Component {
  state: state = {
    jobType: null,
    jobSelected: null,
    jobs: [],
    searchText: "",
    filteredJobs: [],
  };

  _callbackId?: number = null;

  fuse?: any = null

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

    this._callbackId = addCallback(type, (data: JobType[]) => {
      if (this.state.jobs != data) {
        this.setState(() => ({ jobs: data, filteredJobs: data }));

        this.fuse = new Fuse(data, {
          shouldSort: true,
          threshold: 0.6,
          location: 0,
          distance: 100,
          maxPatternLength: 32,
          minMatchCharLength: 1,
          keys: [
            "name", 'inputFileName', 'createdAt', 'submittedDate', 'assembly'
          ]
        });
      }
    });
  }

  filterList = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.fuse) {
      const res = this.fuse.search(e.target.value);
      this.setState(() => ({
        filteredJobs: res
      }));
    }
  }

  render() {
    return (
      <div id='public-page' className='centered'>
        <input id='public-search' className='outlined' type='text' placeholder='search' onChange={(e) => this.filterList(e)} />
        {this.state.filteredJobs.map((job, idx) =>
          <div key={idx} className='card shadow1'>
            <h5 className='header'>{job.name}</h5>
            <div className='content'>
              <div className='row'>
                <span className='left'>Created on:</span>
                <b className='right'>{job.createdAt}</b>
              </div>
              <div className='row'>
                <span className='left'>Assembly</span>
                <b className='right'>{job.assembly}</b>
              </div>
              <div className='row'>
                <span className='left'>{job.type == 'annotation' ? "Input:" : "Query:"}</span>
                <b className='right'>
                  {
                    job.type == 'annotation'
                      ? <a href={job.inputFileName}>{job.inputFileName}</a>
                      : "Some query"
                  }
                </b>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  }
}

export default Jobs;
