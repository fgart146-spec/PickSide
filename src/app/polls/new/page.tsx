import { getVisibleCategories } from "@/lib/home-data";
import { NewPollForm } from "@/components/new-poll-form";

export default async function NewPollPage() {
  const categories = await getVisibleCategories();
  return <NewPollForm categories={categories} />;
}
