import { Link } from "react-router-dom";
import { ShieldIcon, TruckIcon, WalletIcon } from "../shell/icons.jsx";
import { useStore } from "../../../app/StoreProvider.jsx";
import { useEffect, useState } from "react";
import { storefrontService } from "../../../services/storefront.js";

/**
 * Only claims the store can actually keep: the payment methods the checkout
 * really offers, the delivery areas the API really returns, and a policy page
 * that really exists. Nothing here is invented copy.
 */
export default function TrustStrip() {
  const { deliveryAreas, settings, ready } = useStore();
  const [hasReturnPolicy, setHasReturnPolicy] = useState(false);
  useEffect(() => {
    let active = true;
    storefrontService.page("return-policy").then((page) => {
      if (active) setHasReturnPolicy(page.body.length > 0);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const paymentText = "ادفع نقداً عند استلام الطلب";
  const verifiedBusinessContent = ready && !settings.demoBusinessContent;

  return (
    <div className="vs-trust">
      <div className="vs-trust__item">
        <span className="vs-trust__icon">
          <WalletIcon size={20} />
        </span>
        <span>
          <span className="vs-trust__title">الدفع عند الاستلام</span>
          <br />
          <span className="vs-trust__desc">{paymentText}</span>
        </span>
      </div>

      {verifiedBusinessContent && deliveryAreas.length > 0 && <div className="vs-trust__item">
          <span className="vs-trust__icon">
            <TruckIcon size={20} />
          </span>
          <span>
            <span className="vs-trust__title">التوصيل إلى المناطق المتاحة</span>
            <br />
            <span className="vs-trust__desc">تختلف الرسوم حسب المنطقة وتظهر عند إتمام الطلب</span>
          </span>
      </div>}

      {verifiedBusinessContent && hasReturnPolicy && <Link to="/page/return-policy" className="vs-trust__item">
        <span className="vs-trust__icon">
          <ShieldIcon size={20} />
        </span>
        <span>
          <span className="vs-trust__title">سياسة التبديل والإرجاع</span>
          <br />
          <span className="vs-trust__desc">اقرأ الشروط قبل الطلب</span>
        </span>
      </Link>}
    </div>
  );
}
