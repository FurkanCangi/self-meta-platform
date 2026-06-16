import { Suspense } from "react"
import SelfMetaSignupForm from "../components/auth/SelfMetaSignupForm"

export default function AuthSignupPage() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <SelfMetaSignupForm />
    </Suspense>
  )
}
