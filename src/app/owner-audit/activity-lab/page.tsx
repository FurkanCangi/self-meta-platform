import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ActivityLabGallery } from "@/features/regulation-activity-lab/ActivityLabGallery"

export const metadata: Metadata = {
  title: "Self-Regülasyon Aktivite Laboratuvarı",
  robots: {
    index: false,
    follow: false,
  },
}

interface ActivityLabReviewPageProps {
  searchParams: Promise<{ activity?: string | string[] }>
}

export default async function ActivityLabReviewPage({
  searchParams,
}: ActivityLabReviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = await searchParams
  const selectedId = Array.isArray(params.activity) ? params.activity[0] : params.activity

  return <ActivityLabGallery selectedId={selectedId} />
}
