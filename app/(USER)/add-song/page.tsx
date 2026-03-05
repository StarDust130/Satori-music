import { redirect } from "next/navigation";

// Redirect to main page - all functionality is on the home page now
export default function AddSongPage() {
  redirect("/");
}
