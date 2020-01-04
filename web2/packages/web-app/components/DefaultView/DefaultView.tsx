import Link from "next/link";
import "./defaultView.scss";

export default () => (
  <span className="default-view">
    <Link href="/jobs/public">
      <a>Try</a>
    </Link>
    <Link href="/">
      <a>Guide</a>
    </Link>
  </span>
);
