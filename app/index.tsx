import { router } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/splash");
    }, 100); // gives router time to mount

    return () => clearTimeout(timer);
  }, []);

  return null;
}

