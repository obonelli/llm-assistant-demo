// src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootRedirect() {
  // Home = People
  redirect("/people");
}
