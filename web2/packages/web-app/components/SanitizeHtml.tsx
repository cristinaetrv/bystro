// https://stackoverflow.com/questions/38663751/how-to-safely-render-html-in-react
import sanitizeHtml from "sanitize-html";
const defaultOptions = {
  allowedTags: [
    "b",
    "i",
    "em",
    "strong",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "div",
    "span"
  ],
  allowedAttributes: {
    a: ["href", "target"]
  }
};

const sanitize = (dirty, opts?: {}) => ({
  __html: sanitizeHtml(dirty, { ...defaultOptions, ...opts })
});

// TODO: make className work
type props = {
  html: string;
  className: {};
  options?: {};
};
export default (props: props) => (
  <div dangerouslySetInnerHTML={sanitize(props.html, props.options)} />
);
