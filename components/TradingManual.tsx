import { useState } from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface Props {
  onClose: () => void;
}

export default function TradingManual({ onClose }: Props) {
 
 const [language, setLanguage] = useState<"en" | "fr">("en");

    return (
    
    <Modal
      visible={true}
      transparent
      animationType="fade"
    >
        
      <View style={styles.overlay}>

        <View style={styles.container}>
<View style={styles.languageRow}>

<TouchableOpacity
 onPress={()=>setLanguage("en")}
>
<Text style={language==="en"?styles.activeLang:styles.lang}>
🇬🇧 English
</Text>
</TouchableOpacity>


<TouchableOpacity
 onPress={()=>setLanguage("fr")}
>
<Text style={language==="fr"?styles.activeLang:styles.lang}>
🇫🇷 Français
</Text>
</TouchableOpacity>

</View>
          <ScrollView
            showsVerticalScrollIndicator={true}
          >

           <Text style={styles.title}>
  {language === "en"
    ? "🚀 FX ARENA\nONBOARDING GUIDE"
    : "🚀 FX ARENA\nGUIDE D'ACCUEIL"}
</Text>

            <Text style={styles.subtitle}>
  {language === "en"
    ? "Welcome to Forex Tournaments Arena"
    : "Bienvenue dans Forex Tournaments Arena"}
</Text>

<Text style={styles.text}>
  {language === "en"
    ? "Learn, practice, compete and climb the leaderboard."
    : "Apprenez, pratiquez, participez aux compétitions et grimpez dans le classement."}
</Text>


            <Section
               titleEn="1. Complete Your Profile 👤"
  titleFr="1. Complétez votre profil 👤"
              language={language}
              en={`
Start from the Profile icon on the left menu.

• Add your personal details
• Upload your avatar/photo
• Complete verification requirements

Without verification your profile remains unverified.
`}
              fr={`
Commencez avec l'icône Profil dans le menu gauche.

• Ajoutez vos informations personnelles
• Téléchargez votre avatar/photo
• Complétez les étapes de vérification

Sans vérification votre profil reste non vérifié.
`}
            />


            <Section
              titleEn="2. Explore The Left Menu 📌"
titleFr="2. Explorez le menu gauche 📌"
              language={language}
              en={`
The left menu is vertically scrollable.

Use it to access:

👤 Profile
💰 Deposit / Withdraw
🏆 Tournaments
🎁 Invite & Earn
🔔 Alerts
ℹ️ About
`}
              fr={`
Le menu gauche peut être défilé verticalement.

Vous pouvez accéder à :

👤 Profil
💰 Dépôt / Retrait
🏆 Tournois
🎁 Inviter et gagner
🔔 Alertes
ℹ️ À propos
`}
            />


            <Section
             titleEn="3. Account Switcher 💼"
titleFr="3. Sélecteur de compte 💼"
              language={language}
              en={`
The account switcher is located at the top-right corner.

Tap it to switch between:

• Demo Account
• Tournament Account
• Real Account

Use the bank icon for deposit and withdrawal actions.
`}
              fr={`
Le sélecteur de compte se trouve en haut à droite.

Appuyez dessus pour changer entre :

• Compte Démo
• Compte Tournoi
• Compte Réel

Utilisez l'icône banque pour les dépôts et retraits.
`}
            />


            <Section
              titleEn="4. Setting Your Trade 🎯"
titleFr="4. Configuration de votre trade 🎯"
              language={language}
              en={`
Trade Size:
Tap the Trade Size box to open the keypad.
Enter the amount you want to trade.

Expiration:
Tap the expiration box and select your preferred time.

Tap outside to close.
`}
              fr={`
Taille du trade :
Appuyez sur la case Trade Size pour ouvrir le clavier.
Entrez le montant à trader.

Expiration :
Appuyez sur la case expiration et choisissez la durée.

Appuyez ailleurs pour fermer.
`}
            />

<Section
  titleEn="5. Understanding FX Arena Trade Mode ⚡"
titleFr="5. Comprendre le mode de trading FX Arena ⚡"
  language={language}
  en={`
FX Arena uses an automatic fixed-time trading mode.

Before entering a trade:

• Choose your Trade Size
• Choose your Expiration Time

Once you press BUY or SELL, the trade starts immediately and the expiration time cannot be changed.

At the end of the selected time:

🟢 Price moves in your chosen direction = Profit
🔴 Price moves opposite to your chosen direction = Loss

There is no manual closing, take profit or stop loss.
Your result is decided automatically when the timer expires.
`}
  fr={`
FX Arena utilise un mode de trading automatique avec durée fixe.

Avant d'entrer dans un trade :

• Choisissez votre taille de trade
• Choisissez votre durée d'expiration

Une fois que vous appuyez sur BUY ou SELL, le trade démarre immédiatement et la durée ne peut plus être modifiée.

À la fin du temps choisi :

🟢 Le prix évolue dans la direction que vous avez choisie = Profit
🔴 Le prix évolue dans la direction opposée à votre choix = Perte

Il n'y a pas de fermeture manuelle, de take profit ou de stop loss.
Votre résultat est déterminé automatiquement à la fin du chronomètre.
`}
/>
            <Section
             titleEn="6. Buy And Sell 📈"
titleFr="6. Acheter et Vendre 📈"
              language={language}
              en={`
BUY 🟢
Press BUY when you believe the price will move upward.

SELL 🔴
Press SELL when you believe the price will move downward.

Every decision affects your trading journey.
`}
              fr={`
ACHAT 🟢
Appuyez sur BUY lorsque vous pensez que le prix va monter.

VENTE 🔴
Appuyez sur SELL lorsque vous pensez que le prix va descendre.

Chaque décision influence votre parcours de trading.
`}
            />


            <Section
              titleEn="7. Tournaments & Leaderboard 🏆"
titleFr="7. Tournois et Classement 🏆"
              language={language}
              en={`
Open Tournaments from the left menu.

Tap a tournament card to view:

• Information
• Rules
• Prize details
• Leaderboard

Leaderboard supports vertical and horizontal scrolling.

Press ALL button at top of the screen to view the complete leaderboard.
`}
              fr={`
Ouvrez les Tournois depuis le menu gauche.

Appuyez sur une carte tournoi pour voir :

• Informations
• Règles
• Prix
• Classement

Le classement peut être défilé verticalement et horizontalement.

Appuyez sur ALL button en haut de l'écran pour voir tout le classement.
`}
            />


            <Section
              titleEn="8. Stay Updated 🔔"
titleFr="8. Restez informé 🔔"
              language={language}
              en={`
Check Alerts regularly for important announcements.

Stay disciplined. Keep learning. Enjoy the competition!
`}
              fr={`
Consultez régulièrement les Alertes pour les annonces importantes.

Restez discipliné. Continuez à apprendre. Profitez de la compétition !
`}
            />


            <TouchableOpacity
  style={styles.button}
  onPress={onClose}
>
  <Text style={styles.buttonText}>
    {language === "en"
      ? "START TRADING 🚀"
      : "COMMENCER À TRADER 🚀"}
  </Text>
</TouchableOpacity>

          </ScrollView>

        </View>

      </View>
    </Modal>
  );
}



function Section({
  titleEn,
  titleFr,
  en,
  fr,
  language,
}: {
  titleEn:string;
  titleFr:string;
  en:string;
  fr:string;
  language:"en" | "fr";
}) {

  return (
    <View style={styles.section}>

     <Text style={styles.sectionTitle}>
  {language === "en" ? titleEn : titleFr}
</Text>

      <Text style={styles.text}>
        {language === "en" ? en : fr}
      </Text>

    </View>
  );
}


const styles = StyleSheet.create({

overlay:{
  flex:1,
  backgroundColor:"rgba(0,0,0,0.75)",
  justifyContent:"center",
  alignItems:"center",
},


container:{
  width:"88%",
  height:"82%",
   backgroundColor:"rgba(21,21,21,0.88)",
  borderRadius:15,
  padding:15,
  borderWidth:1,
  borderColor:"#444",
},


title:{
  color:"gold",
  fontSize:20,
  fontWeight:"bold",
  textAlign:"center",
  marginBottom:8,
},


subtitle:{
  color:"#fff",
  fontSize:16,
  fontWeight:"bold",
  textAlign:"center",
},


section:{
  marginTop:18,
  borderBottomWidth:1,
  borderBottomColor:"#333",
  paddingBottom:10,
    textAlign:"center",
},


sectionTitle:{
  color:"#00ff11ff",
  fontSize:16,
  fontWeight:"bold",
  marginBottom:6,
    textAlign:"center",
},


text:{
  color:"#ddd",
  fontSize:14,
  lineHeight:20,
    textAlign:"center",
},


fr:{
  color:"#aaa",
  fontSize:14,
  lineHeight:20,
  marginTop:8,
   textAlign:"center",
},


button:{
  backgroundColor:"#00c853",
  marginTop:20,
  marginBottom:20,
  padding:14,
  borderRadius:10,
  alignItems:"center",
},


buttonText:{
  color:"#fff",
  fontWeight:"bold",
  fontSize:16,
},
languageRow:{
  flexDirection:"row",
  justifyContent:"center",
  marginBottom:15,
  gap:20,
},

lang:{
  color:"#aaa",
  fontSize:14,
  padding:8,
},

activeLang:{
  color:"gold",
  fontWeight:"bold",
  fontSize:14,
  padding:8,
  borderBottomWidth:2,
  borderBottomColor:"gold",
},

});