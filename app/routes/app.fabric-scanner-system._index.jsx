import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Shopify app template">
      <s-section heading="Welcome To B2B Orders Import app">
        <s-paragraph>
          This shopify embedded app helps you to create B2B orders by uploading
          the CSV sheet.
        </s-paragraph>
      </s-section>
      <s-section heading="Features">
        <s-paragraph>
          <s-unordered-list>
            <s-list-item>
              Customer can create orders by uploading the CSV sheet from
              storefront
            </s-list-item>
            <s-list-item>
              Staff Member can create orders by uploading the CSV sheet by
              navigating to <s-link href="/app/home">Import Orders</s-link> link
            </s-list-item>
            <s-list-item>
              In the <s-link href="/app/history">History</s-link> page, history
              of all B2B orders created by Customer or Staff member can be seen.
            </s-list-item>
          </s-unordered-list>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Getting Started">
        <s-paragraph>
          You can Navigate to <s-link href="/app/home">Import Orders</s-link>{" "}
          page to create B2B Orders.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Additional Information">
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://drive.google.com/uc?export=download&id=1FPB2P_Qyif6KvOg5JdPQye0JstpKNRho"
              target="_blank"
            >
              Download
            </s-link>{" "}
            the Sample CSV sheet
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
