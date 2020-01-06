import { memo } from "react";
import Link from "next/link";

export default memo(
  (props: any) => {
    return (
      <Link href={props.href}>
        <a className={props.pathname === props.active ? "active" : ""}>
          {props.title}
        </a>
      </Link>
    );
  },
  (prevProps, nextProps) => {
    if (
      (prevProps.pathname !== nextProps.pathname &&
        prevProps.pathname === prevProps.active) ||
      nextProps.pathname === prevProps.active
    ) {
      return false;
    }

    return true;
  }
);
