import dynamic from 'next/dynamic';

const Page = dynamic(() => import('@/components/AppClient'), { ssr: false });

export default Page;
