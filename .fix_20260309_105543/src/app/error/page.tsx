"use client"
import React from 'react'
import Link from 'next/link';
import Image from 'next/image';

import Switcher from '../components/switcher';
import BackButton from '../components/back-button';

export default function Page() {

    return (
        <>
            <section className="relative bg-primary/5">
                <div className="container-fluid relative">
                    <div className="grid grid-cols-1">
                        <div className="flex flex-col min-h-screen justify-center md:px-10 py-10 px-4">
                            <div className="text-center">
                                <Link href="/"><Image src='/images/logo-icon-64.png' width={72} height={64} placeholder='blur' blurDataURL='/images/logo-icon-64.png' className="mx-auto" alt="" /></Link>
                            </div>
                            <div className="title-heading text-center my-auto">
                                <Image src='/images/error.png' width={200} height={200}  placeholder='blur' blurDataURL='/images/error.png'  className="mx-auto" alt="" />
                                <h1 className="mt-3 mb-6 md:text-5xl text-3xl font-bold">Page Not Found?</h1>
                                <p className="text-slate-400">Whoops, this is embarassing. <br /> Looks like the page you were looking for wasnt found.</p>

                                <div className="mt-4">
                                    <Link href="/" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Back to Home</Link>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="mb-0 text-slate-400">© {new Date().getFullYear()} Self Metacognition Institute. Design & Develop with <i className="mdi mdi-heart text-red-600"></i> by <Link href="/https://shreethemes.in/" target="_blank" className="text-reset">Shreethemes</Link>.</p>
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
