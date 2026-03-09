import React from "react";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";

import { MdKeyboardArrowRight } from "react-icons/md";
import { GoMention } from "react-icons/go";

export default function Page() {

  return (
    <Wrapper>
         <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Checkout</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Self Metacognition Institute</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/shop">Shop</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Checkout</li>
                    </ul>
                </div>

                <div className="grid lg:grid-cols-12 md:grid-cols-2 grid-cols-1 mt-6 gap-6">
                    <div className="lg:col-span-8">
                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <h3 className="text-xl leading-normal font-semibold">Billing address</h3>

                            <form>
                                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-5">
                                    <div className="lg:col-span-6">
                                        <label className="form-label font-semibold">First Name : <span className="text-red-600">*</span></label>
                                        <input type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="First Name:" id="firstname" name="name"/>
                                    </div>

                                    <div className="lg:col-span-6">
                                        <label className="form-label font-semibold">Last Name : <span className="text-red-600">*</span></label>
                                        <input type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Last Name:" id="lastname" name="name"/>
                                    </div>

                                    <div className="lg:col-span-6">
                                        <label className="form-label font-semibold">Username</label>
                                        <div className="relative mt-2">
                                            <span className="absolute top-0.5 start-0.5 size-9 text-xl bg-gray-100 dark:bg-slate-800 inline-flex justify-center items-center text-dark dark:text-white rounded" id="basic-addon1"><GoMention/></span>
                                            <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Username" required/>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-6">
                                        <label className="form-label font-semibold">Your Email : <span className="text-red-600">*</span></label>
                                        <input type="email" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Email" name="email"/>
                                    </div>

                                    <div className="lg:col-span-12">
                                        <label className="form-label font-semibold">Address : <span className="text-red-600">*</span></label>
                                        <input type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Address:" id="address" name="name"/>
                                    </div>

                                    <div className="lg:col-span-12">
                                        <label className="form-label font-semibold">Address 2 : </label>
                                        <input type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Address:" id="address" name="name"/>
                                    </div>

                                    <div className="lg:col-span-4">
                                        <label className="font-semibold">Country:</label>
                                        <select className="form-select form-input mt-2 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0">
                                            <option value="USA">USA</option>
                                            <option value="CAD">Canada</option>
                                            <option value="CHINA">China</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-4">
                                        <label className="font-semibold">State:</label>
                                        <select className="form-select form-input mt-2 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0">
                                            <option value="CAL">California</option>
                                            <option value="TEX">Texas</option>
                                            <option value="FLOR">Florida</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-4">
                                        <label className="form-label font-semibold">Zip Code : <span className="text-red-600">*</span></label>
                                        <input type="number" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Zip:" id="zipcode" name="number"/>
                                    </div>

                                    <div className="lg:col-span-12">
                                        <div className="flex items-center w-full mb-0">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" type="checkbox"  id="sameaddress"/>
                                            <label className="form-check-label text-slate-400" htmlFor="sameaddress">Shipping address is the same as my billing address</label>
                                        </div>

                                        <div className="flex items-center w-full mb-0">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" type="checkbox"  id="savenexttime"/>
                                            <label className="form-check-label text-slate-400" htmlFor="savenexttime">Save this information for next time</label>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <h3 className="text-xl leading-normal font-semibold mt-6">Payment</h3>
                            <form>
                                    <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-5">
                                        <div className="lg:col-span-12">
                                            <div className="block">
                                                <div>
                                                    <label className="inline-flex items-center">
                                                        <input type="radio" className="form-radio size-4 appearance-none rounded-full border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" name="radio-colors" defaultValue="1" defaultChecked />
                                                        <span className="text-slate-400">Credit card</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="block mt-2">
                                                <div>
                                                    <label className="inline-flex items-center">
                                                        <input type="radio" className="form-radio size-4 appearance-none rounded-full border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" name="radio-colors" defaultValue="1"/>
                                                        <span className="text-slate-400">Debit Card</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="block mt-2">
                                                <div>
                                                    <label className="inline-flex items-center">
                                                        <input type="radio" className="form-radio size-4 appearance-none rounded-full border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" name="radio-colors" defaultValue="1"/>
                                                        <span className="text-slate-400">PayPal</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-6">
                                            <label className="form-label font-semibold">Account Holder Name : <span className="text-red-600">*</span></label>
                                            <input type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Name:" id="accountname" name="name"/>
                                        </div>

                                        <div className="lg:col-span-6">
                                            <label className="form-label font-semibold">Credit card number : <span className="text-red-600">*</span></label>
                                            <input type="number" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="**** **** **** ****" id="cardnumber" name="number"/>
                                        </div>

                                        <div className="lg:col-span-3">
                                            <label className="form-label font-semibold">Expiration : <span className="text-red-600">*</span></label>
                                            <input type="number" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="" id="expiration" name="number"/>
                                        </div>

                                        <div className="lg:col-span-3">
                                            <label className="form-label font-semibold">CVV : <span className="text-red-600">*</span></label>
                                            <input type="number" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="" id="cvv" name="number"/>
                                        </div>
                                    </div>
                                </form>
                            
                            <div className="mt-4">
                                <input type="submit" className="py-2 px-5 inline-block tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md w-full" defaultValue="Continue to checkout"/>
                            </div>
                        </div>

                    </div>

                    <div className="lg:col-span-4">
                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="flex justify-between items-center">
                                <h5 className="text-lg font-semibold">Your Cart</h5>

                                <Link href="#" className="bg-primary flex justify-center items-center text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full h-5">3</Link>
                            </div>

                            <div className="mt-4 rounded-md shadow-sm dark:shadow-gray-700">
                                <div className="p-3 flex justify-between items-center">
                                    <div>
                                        <h5 className="font-semibold">Product Name</h5>
                                        <p className="text-sm text-slate-400">Brief description</p>
                                    </div>

                                    <p className="text-slate-400 font-semibold">$ 12</p>
                                </div>
                                <div className="p-3 flex justify-between items-center border border-gray-100 dark:border-gray-800">
                                    <div>
                                        <h5 className="font-semibold">Second product</h5>
                                        <p className="text-sm text-slate-400">Brief description</p>
                                    </div>

                                    <p className="text-slate-400 font-semibold">$ 18</p>
                                </div>
                                <div className="p-3 flex justify-between items-center border border-gray-100 dark:border-gray-800">
                                    <div>
                                        <h5 className="font-semibold">Third item</h5>
                                        <p className="text-sm text-slate-400">Brief description</p>
                                    </div>

                                    <p className="text-slate-400 font-semibold">$ 20</p>
                                </div>
                                <div className="p-3 flex justify-between items-center border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800 text-green-600">
                                    <div>
                                        <h5 className="font-semibold">Promo code</h5>
                                        <p className="text-sm text-green-600">EXAMPLECODE</p>
                                    </div>

                                    <p className="text-red-600 font-semibold">-$ 10</p>
                                </div>
                                <div className="p-3 flex justify-between items-center border border-gray-100 dark:border-gray-800">
                                    <div>
                                        <h5 className="font-semibold">Total (USD)</h5>
                                    </div>

                                    <p className="font-semibold">$ 30</p>
                                </div>
                            </div>

                            <div className="subcribe-form mt-6">
                                <form className="relative max-w-xl">
                                    <input type="email" id="subcribe" name="email" className="py-4 pe-40 ps-6 w-full h-12.5 outline-none text-black dark:text-white rounded-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700" placeholder="Promo code"/>
                                    <button type="submit" className="py-2 px-5 inline-block font-semibold tracking-wide align-middle duration-500 text-base text-center absolute top-0.5 end-0.75 h-11.5 bg-primary hover:bg-primary-700 border border-primary hover:border-primary-700 text-white rounded-full">Redeem</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
    
  )
}
