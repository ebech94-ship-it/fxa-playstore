import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Flutterwave returns status + tx_ref
    console.log("Payment result:", params);

    setTimeout(() => {
      router.replace("./Tradinglayout"); // go back home
    }, 1500);
  }, []);

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
      <Text style={{fontSize:20, color:"white"}}>Payment Successful 🎉</Text>
    </View>
  );
}
