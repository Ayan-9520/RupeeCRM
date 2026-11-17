import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseReader } from "@/components/learn/CourseReader";
import { getCourse } from "@/lib/courses";

export const Route = createFileRoute("/dashboard/learn/$slug")({
  loader: ({ params }) => {
    const course = getCourse(params.slug);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.course ? `${loaderData.course.title} — Learn` : "Course — RupeeOne" }],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { course } = Route.useLoaderData();
  return <CourseReader course={course} />;
}
