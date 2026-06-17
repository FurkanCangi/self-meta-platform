import { Suspense } from "react"
import DnaSignupForm from "../components/auth/DnaSignupForm"

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <DnaSignupForm />
    </Suspense>
  )
}
