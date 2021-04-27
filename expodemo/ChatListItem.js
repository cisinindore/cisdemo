import React from "react";
import { TouchableOpacity, Text, Image, View, StyleSheet } from "react-native";

import ChatSettings from './ChatSettings';

const goToChatScreen = (navigation, data, headerTitle,receivedMsg,chatRoomId) => {
  console.log("Navigate" + navigation.navigate + "\nnewsID" );
  navigation.navigate("ChatDetail", {
    data: data,
    chatRoomId: chatRoomId,
    receivedMsg: receivedMsg,
    screenHeaderTitle: headerTitle,
  });
};


const ChatListItem = (props) => {
  const showChatSettings = () => {
    console.log("child")
    props.callback(props.UserName);
  };
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() =>
        goToChatScreen(props.navigation, props.chatData, props.UserName,props.onRecieveMsg,props.chatRoomId)
      }
      onLongPress={() => showChatSettings()}
    >
      <Image
        source={{
          uri: props.ImgUrl,
        }}
        style={styles.avatar}
      />
      <View style={styles.dataContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{props.UserName}</Text>
          <Text style={styles.timestamp}>{props.TimeStamp}</Text>
        </View>
        <Text style={styles.description}>{props.LastMessage}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 70,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.2,
    borderBottomColor: "#5DD29B",
    flexDirection: "row",
    alignItems: "center",
  },
  dataContainer: {
    flex: 1,
    paddingLeft: 15,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timestamp: {
    fontSize: 12,
    color: "grey",
    opacity: 0.6,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: "cover",
  },
  title: {
    marginBottom: 5,
    fontSize: 16,
    fontWeight: "bold",
  },
  description: {
    fontSize: 12,
    color: "grey",
  },
});

export default ChatListItem;
