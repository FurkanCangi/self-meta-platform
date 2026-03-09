'use client'
import React, { useState } from "react";
import Link from "next/link";

export default function SentCoin(){
    let [open, setOpen] = useState<boolean>(false)

    const openModal = () =>{
        setOpen(!open)
    }
   
    return(
        <>
        <Link href="#" className="py-1.25 px-4 me-1 inline-block font-semibold tracking-wide align-middle duration-500 text-sm text-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-white rounded-md" onClick={openModal}>Sent</Link>

        <div className={`${open === true ? '' : 'hidden'} fixed z-999  overflow-hidden inset-0 m-auto flex justify-center items-center bg-slate-900/70`} >
            <div className="relative w-full h-auto max-w-xl p-4">
                <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-sm dark:shadow-gray-700">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h5 className="text-xl font-semibold">Send Coin</h5>
                        <button type="button" onClick={openModal} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ms-auto inline-flex items-center dark:hover:bg-gray-800 dark:hover:text-white" data-modal-toggle="sentCrypto">
                            <svg className="size-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>  
                        </button>
                    </div>
                    <div className="p-6">
                        <form action="">
                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-12">
                                    <label className="font-semibold">Crypto Currency</label>
                                    <select className="form-select form-input mt-2 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0">
                                        <option>-- Currency --</option>
                                        <option value="BTC">BTC</option>
                                        <option value="ETH">ETH</option>
                                    </select>
                                </div>

                                <div className="col-span-12">
                                    <label className="font-semibold">Currency From</label>
                                    <select className="form-select form-input mt-2 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0">
                                        <option >-- My wallet --</option>
                                        <option value="BTC">BTC</option>
                                        <option value="ETH">ETH</option>
                                    </select>
                                </div>

                                <div className="col-span-12">
                                    <label className="form-label font-semibold">To</label>
                                    <div className="relative mt-2">
                                        <span className="absolute top-0.5 start-0.5 size-9 text-xl bg-gray-100 dark:bg-slate-800 inline-flex justify-center items-center text-dark dark:text-white rounded" id="QUcode"><i className="uil uil-qrcode-scan"></i></span>
                                        <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Can you scan" required/>
                                    </div>
                                </div>

                                <div className="md:col-span-6 col-span-12">
                                    <label className="form-label font-semibold">USD</label>
                                    <div className="relative mt-2">
                                        <span className="absolute top-0.5 start-0.5 size-9 text-xl bg-gray-100 dark:bg-slate-800 inline-flex justify-center items-center text-dark dark:text-white rounded" id="USD"><i className="uil uil-dollar-sign"></i></span>
                                        <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="USD" required/>
                                    </div>
                                </div>

                                <div className="md:col-span-6 col-span-12">
                                    <label className="form-label font-semibold">BTC</label>
                                    <div className="relative mt-2">
                                        <span className="absolute top-0.5 start-0.5 size-9 text-xl bg-gray-100 dark:bg-slate-800 inline-flex justify-center items-center text-dark dark:text-white rounded" id="BTC"><i className="uil uil-bitcoin-circle"></i></span>
                                        <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="BTC" required/>
                                    </div>
                                </div>

                                <div className="col-span-12">
                                    <label htmlFor="comments" className="font-semibold">Description</label>
                                    <div className="relative mt-2">
                                        <textarea name="comments" id="comments" className="form-input w-full py-2 px-3 h-28 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Description"></textarea>
                                    </div>
                                </div>

                                <div className="col-span-12">
                                    <h6 className="font-semibold">Network Free</h6>

                                    <div className="inline-block mt-2">
                                        <div>
                                            <label className="inline-flex items-center">
                                                <input type="radio" className="form-radio size-4 appearance-none rounded-full border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" defaultChecked name="radio-colors" value="1"/>
                                                <span className="text-slate-400">Regular</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="inline-block mt-2 ms-2">
                                        <div>
                                            <label className="inline-flex items-center">
                                                <input type="radio" className="form-radio size-4 appearance-none rounded-full border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" name="radio-colors" value="1"/>
                                                <span className="text-slate-400">Priority</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div className="text-end p-4 border-t border-gray-100 dark:border-gray-700">
                        <Link href="#" className="py-1.25 px-4 inline-block font-semibold tracking-wide align-middle duration-500 text-sm text-center bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white rounded-md me-1" onClick={openModal}>Close</Link>
                        <Link href="#" className="py-1.25 px-4 inline-block font-semibold tracking-wide align-middle duration-500 text-sm text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Continue</Link>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}