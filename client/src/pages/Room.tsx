import { useParams } from "react-router";

export function Room() {
	const { code } = useParams<{ code: string }>();
	return <div>Room: {code}</div>;
}