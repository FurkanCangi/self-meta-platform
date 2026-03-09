import React from 'react';
import Link from 'next/link';

import Switcher from '../components/switcher';
import BackButton from '../components/back-button';
import { FiThumbsUp } from 'react-icons/fi';

export default function Page() {
    return (
            <>
            <section className="relative h-screen flex items-center justify-center text-center bg-gray-50 dark:bg-slate-800">
                <div className="container relative">
                    <div className="grid grid-cols-1">
                        <div className="title-heading text-center my-auto">
                            <div className="size-24 bg-primary/5 text-primary rounded-full text-5xl flex align-middle justify-center items-center shadow-xs dark:shadow-gray-800 mx-auto">
                                <FiThumbsUp className='size-11'/>
                            </div>
                            <h1 className="mt-6 mb-8 md:text-5xl text-3xl font-bold">Thank You</h1>
                            <p className="text-slate-400 max-w-xl mx-auto">Launch your campaign and benefit from our expertise on designing and managing conversion centered Tailwind x3 html page.</p>

                            <div className="mt-6">
                                <Link href="/" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle transition duration-500 ease-in-out text-base text-center bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white rounded-md">Back to Home</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Switcher/>
            <BackButton/>
            </>
    )
}


