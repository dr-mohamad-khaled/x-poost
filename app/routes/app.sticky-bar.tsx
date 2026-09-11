import { redirect } from "react-router";

export const loader = async () => {
  return redirect("/app");
};

export default function StickyBar() {
  return null;
}
