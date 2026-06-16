import React from "react"
import Link from "next/link"

export default function Footer(){
    return(
        <footer>
           <div className="shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 px-6 py-4">
                <div className="container-fluid">
                     <div className="grid grid-cols-1">
                        <div className="sm:text-start text-center mx-md-2">
                            <p className="mb-0 text-slate-400">© {(new Date().getFullYear())} DNA Intelligence. Tüm hakları saklıdır.</p>
                        </div>
                     </div>
                    
                </div>
           </div>
        </footer>
    )
}
