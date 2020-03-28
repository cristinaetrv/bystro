import Link from "next/link";

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
