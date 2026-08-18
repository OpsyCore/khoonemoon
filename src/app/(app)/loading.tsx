import { LoadingState } from "@/shared/ui/loading-state";

export default function AppLoading() {
  return (
    <div className="space-y-3">
      <LoadingState label="در حال بارگذاری صفحه..." />
      <LoadingState label="لطفاً چند لحظه صبر کنید" />
    </div>
  );
}
