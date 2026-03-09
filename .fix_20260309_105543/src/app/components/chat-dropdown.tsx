'use client'
import React,{useEffect, useState}  from "react";
import Link from "next/link"

export default function ChatDropdown(){
    let [open, setOpen] = useState<boolean>(false)

    useEffect(() => {

        let DropdownHandler = ()=>{
            setOpen(false)
        }
        document.addEventListener('mousedown', DropdownHandler)
        return()=>{
            document.removeEventListener('mousedown', DropdownHandler)
        }
    }, []);
    return(
        <div className="dropdown relative">
            <button onClick={() => setOpen(!open)} className="dropdown-toggle items-center" type="button">
                <span className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[20px] text-center bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white rounded-full"><i className="mdi mdi-dots-vertical"></i></span>
            </button>
            <div className={`dropdown-menu absolute end-0 m-0 mt-4 z-10 w-44 rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 ${open ?  '' : 'hidden'}`}>
                <ul className="py-2 text-start">
                    <li>
                        <Link href="" className="block font-medium py-1.5 px-4 hover:text-primary"><i className="mdi mdi-account-outline"></i> Profile</Link>
                    </li>
                    <li>
                        <Link href="" className="block font-medium py-1.5 px-4 hover:text-primary"><i className="mdi mdi-cog-outline"></i> Profile Settings</Link>
                    </li>
                    <li>
                        <Link href="" className="block font-medium py-1.5 px-4 hover:text-primary"><i className="mdi mdi-trash-can-outline"></i> Delete</Link>
                    </li>
                </ul>
            </div>
        </div>
    )
}
