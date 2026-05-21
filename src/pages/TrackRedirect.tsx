import { Navigate, useParams } from "react-router-dom";

export default function TrackRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={{ pathname: "/", search: id ? `?track=${encodeURIComponent(id)}` : "" }}
      replace
    />
  );
}
