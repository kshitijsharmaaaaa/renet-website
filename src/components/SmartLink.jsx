import { Link, useLocation } from "react-router-dom";

/*
  One link component for every RENET page:
  - "#section"        → plain in-page anchor
  - "/#section"       → plain anchor when already on the homepage (smooth, repeatable),
                        otherwise a route change that HomePage scrolls on arrival
  - "/scooters/..."   → client-side route
*/
export default function SmartLink({ to, children, ...rest }) {
  const { pathname } = useLocation();

  if (to.startsWith("#")) {
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    );
  }

  if (to.startsWith("/#") && pathname === "/") {
    return (
      <a href={to.slice(1)} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
}
