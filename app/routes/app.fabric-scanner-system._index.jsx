import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";
import { getAppSettings } from "../models/settings.server";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Button, Text, Box } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getAppSettings(session.shop);
  return { settings };
};

export default function Index() {
  const { settings } = useLoaderData();
  const navigate = useNavigate();
  const [showGif, setShowGif] = useState(true);

  return (
    <Page title="Fabric Scanner">
      <Box
        padding="4"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <Box>
          <Text variant="headingXl" as="h1">
            Fabric Scanner
          </Text>
          <Text variant="bodyLg" as="p" tone="subdued">
            Scan fabric orders effortlessly with your phone&apos;s camera — no external scanner needed.
          </Text>
        </Box>

        <Box
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "999px",
            overflow: "hidden",
            boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
          }}
        >
          <img
            src="/fabric-logo.png"
            alt="Fabric Scanner logo"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
      </Box>

      <Layout>
        <Layout.Section>
          <Box textAlign="center" padding="4">
            <div
              style={{
                maxWidth: "480px",
                margin: "0 auto 2rem",
                borderRadius: "18px",
                overflow: "hidden",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.18)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(241,241,241,0.85))",
              }}
            >
              {showGif ? (
                <img
                  src="/scanner.gif"
                  alt="Scanning animation"
                  style={{ display: "block", width: "100%", height: "auto" }}
                  onError={() => setShowGif(false)}
                />
              ) : (
                <div
                  style={{
                    padding: "3rem 1.5rem",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100px",
                      background: "linear-gradient(to right, #000 0%, #000 20%, #fff 20%, #fff 40%, #000 40%, #000 60%, #fff 60%, #fff 80%, #000 80%, #000 100%)",
                      borderRadius: "12px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "4px",
                        background: "rgba(255, 0, 0, 0.8)",
                        animation: "scan 2s infinite",
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <Button primary size="large" onClick={() => navigate("/app/home")}> 
              Get Started
            </Button>
          </Box>
        </Layout.Section>
      </Layout>
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 50%; }
          100% { top: 100%; }
        }
      `}</style>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
