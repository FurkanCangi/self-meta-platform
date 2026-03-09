"use client"
import React, { useState } from 'react'
import { FiMoreHorizontal } from 'react-icons/fi'
import Link from 'next/link'

export default function SalesBtn() {
    let [show, setShow] = useState<boolean>(false)
  return (
    <div className="dropdown inline-block relative">
    <button  className="dropdown-toggle inline-flex text-[20px] text-center text-slate-400 rounded-full" type="button" onClick={()=>setShow(!show)}>
        <FiMoreHorizontal className="size-5"/>
    </button>
    {show && 
        <div className="dropdown-menu absolute end-0 m-0 mt-1 z-10 w-28 rounded-md bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700">
            <ul className="py-2 text-start">
                <li className='ms-0'>
                    <Link href="" className="block text-sm py-0.5 px-4 dark:text-white/70 hover:text-primary dark:hover:text-white">Today</Link>
                </li>
                <li className='ms-0'>
                    <Link href="" className="block text-sm py-0.5 px-4 dark:text-white/70 hover:text-primary dark:hover:text-white">Weekly</Link>
                </li>
                <li className='ms-0'>
                    <Link href="" className="block text-sm py-0.5 px-4 dark:text-white/70 hover:text-primary dark:hover:text-white">Monthly</Link>
                </li>
                <li className='ms-0'>
                    <Link href="" className="block text-sm py-0.5 px-4 dark:text-white/70 hover:text-primary dark:hover:text-white">Yearly</Link>
                </li>
            </ul>
        </div>
    }
</div>
  )
}