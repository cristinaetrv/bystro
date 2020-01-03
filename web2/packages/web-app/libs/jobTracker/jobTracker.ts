import fetch from "../fetch";
import Callbacks from "../callbacks";
import getConfig from "next/config";
import {
  initIdTokenHandler,
  addCallback as addAuthCallback,
  loggedInEventName,
  loggedOutEventName
} from "../auth";

// const controller = new AbortController();
// const signal = controller.signal;

const url = getConfig().publicRuntimeConfig.API.BASE_URL;

// enum types {
//   "all" = "all",
//   "public" = "public"
// }

export type JobType = {
  name: string;
  updatedAt: string;
  createdAt: string;
  submission: {
    submittedDate: string;
    type: string;
    _id: string;
    addedFileNames: string[];
    log: object[];
    attempts: number;
    state: string;
    queueID: string;
    startedDate: string;
    finishedDate: string;
  };
  userID: string;
  assembly: string;
  email: string;
  inputFileName: string;
  outputBaseFileName: string;
  expireDate: Date;
  visibility: string;
  type: string;
  options: { index: boolean };
  search: object[];
  config: string;
  _id: string;
};

const data: { [type: string]: JobType[] } = {
  all: [],
  completed: [],
  public: []
};

const callback_items = {};
const callbacks = new Callbacks(callback_items);

for (const key in data) {
  callback_items[key] = [];
}

const clearData = () => {
  console.info("data", data);
  for (const key in data) {
    data[key] = [];
    console.info("calling", key);
    callbacks.call(key, data[key]);
  }
};

export function addCallback(
  type: string,
  action: (data: JobType[]) => void,
  triggerOnAddition: boolean = true
): number {
  const id = callbacks.add(type, action);

  if (triggerOnAddition) {
    action(data[type]);
  }

  return id;
}

export const removeCallback = callbacks.remove;

export default {
  get all() {
    return data.all;
  },
  get public() {
    return data.public;
  },
  get completed() {
    return data.completed;
  }
};

let _fetchPromise = null;
async function _preload(token?: string) {
  if (_fetchPromise) {
    console.info("have");
    return Promise.all(_fetchPromise);
  }
  // async function _preload({ signal }: any = {}) {
  if (!token) {
    const auth = initIdTokenHandler();
    token = auth.token;
  }

  _fetchPromise = [["completed", "completed"], ["public", "all/public"]].map(
    async obj => {
      try {
        const resData = await fetch(`${url}/jobs/list/${obj[1]}`, {
          headers: {
            Authorization: "Bearer " + token
          }
        }).then(r => r.json());

        data[obj[0]] = resData;
        // for (let job of resData) {
        //   data[job._id] = job;
        // }

        console.info("all", data["all"], "adding callback for", obj[0]);
        callbacks.call(obj[0], data[obj[0]]);
      } catch (e) {
        console.warn(e);
      }

      _fetchPromise = null;
    }
  );

  return Promise.all(_fetchPromise);
}

export function init() {
  addAuthCallback(loggedInEventName, data => {
    _preload(data[1]);
  });

  addAuthCallback(loggedOutEventName, () => {
    clearData();
  });
}
