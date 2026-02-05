import { createFileRoute } from "@tanstack/react-router";
import { UserImagesDisplay } from "@/features/user-images";

export const Route = createFileRoute("/dashboard/images")({
  component: ImagesPage,
});

function ImagesPage() {
  return <UserImagesDisplay />;
}
