import { redirect } from "next/navigation";

// Redirect to the new player route
export default function GymScreenPage() {
  redirect("/player");
}
