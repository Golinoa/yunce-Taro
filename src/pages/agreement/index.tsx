/**
 * 用户协议 / 隐私政策页 pages/agreement/index
 * 纯静态页面，根据 URL 参数 type 显示不同协议内容
 */
import { View, Text, ScrollView } from '@tarojs/components';
import { useRouter } from '@tarojs/taro';
import React from 'react';
import PageContainer from '@/components/PageContainer';

// ============================================
// 用户协议内容
// ============================================
const UserAgreement: React.FC = () => (
  <View className="px-6 pb-8">
    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">一、协议范围与接受</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        欢迎使用本微信小程序（以下简称“本小程序”）。本小程序由开发团队开发并运营。
      </Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        在您开始使用本小程序之前，请仔细阅读本《用户协议》（以下简称“本协议”）的全部内容。一旦您使用本小程序的任何功能，即视为您已充分理解并同意接受本协议所有条款的约束。如您不同意本协议的任何条款，请立即停止使用本小程序。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">二、服务说明</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本小程序为教师和家长提供课时管理相关服务，包括但不限于：
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          教师端：学生管理、班级管理、课时核销、数据统计等功能；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          家长端：学生课时查询、上课记录查看、课时充值跟踪等功能。
        </Text>
      </View>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们保留随时修改、中断或终止部分或全部服务的权利，且无需事先通知用户。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">三、账号注册与使用</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        您在使用本小程序时需要使用微信授权登录。您应确保提供的身份信息真实、准确、完整。您有责任妥善保管您的账号信息，并对使用您账号进行的所有行为承担法律责任。
      </Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        如发现账号被盗用或存在安全风险，请立即联系我们。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">四、用户行为规范</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        您承诺在使用本小程序过程中遵守法律法规，不得从事以下行为：
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          发布或传播任何违法、违规、侵权、虚假或误导性信息；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          干扰、破坏或限制本小程序的正常运行；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          未经授权访问、篡改或删除本小程序的数据；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          利用本小程序从事任何商业推广或广告活动；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          侵犯他人知识产权、隐私权或其他合法权益。
        </Text>
      </View>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        如您违反上述规定，我们有权采取包括但不限于暂停服务、终止账号等措施。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">五、知识产权</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本小程序的所有内容，包括但不限于文字、图片、图标、界面设计、代码等，均受知识产权法律法规保护，归我们或相关权利人所有。未经我们书面许可，任何单位或个人不得以任何方式复制、转载、改编、翻译、发行或用于商业目的。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">六、免责声明</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本小程序按“现状”和“可得到”的状态提供。我们不对服务的及时性、安全性、准确性作出任何明示或暗示的保证。因不可抗力（包括但不限于自然灾害、政府行为、网络故障等）导致服务中断或数据丢失的，我们不承担任何责任。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">七、协议变更</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们有权根据业务发展需要不时修改本协议。修改后的协议将在本小程序内公布，自公布之日起生效。如您不同意修改后的协议内容，应立即停止使用本小程序。继续使用即视为您接受修改后的协议。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">
        八、法律适用与争议解决
      </Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本协议的订立、执行和解释均适用中华人民共和国法律。因本协议引起的或与本协议有关的任何争议，双方应友好协商解决；协商不成的，任何一方均有权向公司所在地有管辖权的人民法院提起诉讼。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">九、联系我们</Text>
      <View className="bg-muted rounded-lg p-3 mt-2">
        <Text className="text-lg text-muted-foreground block mb-1">
          <Text className="font-medium text-foreground">公司名称：</Text>开发团队
        </Text>
        <Text className="text-lg text-muted-foreground block">
          <Text className="font-medium text-foreground">联系邮箱：</Text>support@example.com
        </Text>
      </View>
    </View>
  </View>
);

// ============================================
// 隐私政策内容
// ============================================
const PrivacyPolicy: React.FC = () => (
  <View className="px-6 pb-8">
    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">一、引言</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们深知个人信息对您的重要性。我们致力于保护您的个人信息安全，并严格遵守相关法律法规。
      </Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本《隐私政策》旨在向您说明我们在您使用本微信小程序时如何收集、使用、存储、共享和保护您的个人信息。请您在使用本小程序前仔细阅读并充分理解本政策。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">二、信息收集</Text>
      <Text className="text-lg font-medium text-foreground block mt-3 mb-2">
        2.1 您主动提供的信息
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">微信账号信息：</Text>
          包括微信昵称、头像、OpenID（通过微信授权获取）；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">角色信息：</Text>
          您选择的角色类型（教师或家长）；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">学生信息：</Text>
          学生姓名、联系方式、课时记录等（由教师录入）；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">班级信息：</Text>
          班级名称、描述等（由教师创建）。
        </Text>
      </View>
      <Text className="text-lg font-medium text-foreground block mt-3 mb-2">
        2.2 自动收集的信息
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">设备信息：</Text>
          设备型号、操作系统版本、网络类型等；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">日志信息：</Text>
          访问时间、浏览记录、操作记录、IP地址等。
        </Text>
      </View>
      <Text className="text-lg font-medium text-foreground block mt-3 mb-2">2.3 第三方SDK信息</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        本小程序集成了微信登录SDK，用于实现微信授权登录功能。相关数据收集和处理遵循微信的隐私政策。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">三、信息使用</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们收集您的个人信息仅用于以下目的：
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          提供、维护和改进本小程序的功能和服务；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          验证您的身份并管理您的账号；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          处理和记录课时信息，生成统计数据；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          向您发送服务通知、重要提醒；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          保障账号安全和交易安全；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          遵守法律法规的要求。
        </Text>
      </View>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        未经您明确同意，我们不会将您的个人信息用于本政策所述目的之外的其他用途。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">四、信息共享与披露</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们严格保护您的个人信息，不会向任何第三方出售、出租或共享您的个人信息，但以下情形除外：
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">获得您的明确同意；</Text>
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">与授权合作伙伴共享：</Text>
          仅为实现本政策所述目的，与为我们提供技术服务的合作伙伴共享必要信息，且要求其承担同等保密义务；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">法律法规要求：</Text>
          根据法律法规、行政或司法机关的要求进行披露；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">保护合法权益：</Text>
          为维护我们或其他用户的合法权益所必需。
        </Text>
      </View>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">五、信息存储与保护</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        您的个人信息存储在中华人民共和国境内，存储期限为实现本政策所述目的所必需的时间，或法律法规规定的期限。
      </Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们采用了业界通用的安全技术措施来保护您的个人信息，包括数据加密、访问控制、安全审计等。我们会尽最大努力保护您的个人信息安全，但请注意，互联网环境并非绝对安全。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">六、您的权利</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        您对您的个人信息享有以下权利：
      </Text>
      <View className="pl-4 mb-2">
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">查询与更正：</Text>
          您可以在本小程序中查询和更正您的个人信息；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">删除：</Text>
          在特定情形下，您可以要求我们删除您的个人信息；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">撤回同意：</Text>
          您可以撤回之前给予的同意，撤回后我们将不再处理相应信息；
        </Text>
        <Text className="text-lg text-muted-foreground leading-loose block mb-1">
          <Text className="font-medium text-foreground">注销账号：</Text>
          您可以申请注销您的账号，注销后我们将删除或匿名化处理您的个人信息。
        </Text>
      </View>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">七、未成年人保护</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们高度重视对未成年人个人信息的保护。如果您是未满14周岁的未成年人，请在监护人的陪同下阅读本政策，并在取得监护人同意后使用本小程序。我们不会主动收集未成年人的个人信息，如我们发现在未获得监护人同意的情况下收集了未成年人的个人信息，我们将尽快删除相关信息。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">八、隐私政策变更</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        我们可能会不时修订本政策。修订后的政策将在本小程序内公布。对于重大变更，我们会以更显著的方式通知您。如您在政策变更后继续使用本小程序，即视为您接受变更后的隐私政策。
      </Text>
    </View>

    <View className="mb-5">
      <Text className="text-xl font-semibold text-foreground block mb-2">九、联系我们</Text>
      <Text className="text-lg text-muted-foreground leading-loose block mb-2">
        如您对本隐私政策有任何疑问、意见或建议，请通过以下方式联系我们：
      </Text>
      <View className="bg-muted rounded-lg p-3 mt-2">
        <Text className="text-lg text-muted-foreground block">
          <Text className="font-medium text-foreground">联系邮箱：</Text>privacy@example.com
        </Text>
      </View>
    </View>
  </View>
);

// ============================================
// 协议页面主组件
// ============================================
const Agreement: React.FC = () => {
  const router = useRouter();
  const type = router.params.type || 'user';

  const title = type === 'privacy' ? '隐私政策' : '用户协议';

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle flex flex-col">
        {/* 标题区 */}
        <View className="bg-gradient-primary px-6 pt-6 pb-8 rounded-b-60rpx shadow-elegant relative overflow-hidden">
          <View className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
          <Text className="text-white text-[40rpx] font-bold block relative z-1">{title}</Text>
          <Text className="text-white/70 text-md block mt-1 relative z-1">
            最近更新日期：2025年1月1日
          </Text>
        </View>

        {/* 协议正文 */}
        <ScrollView scrollY className="flex-1 h-0">
          {type === 'privacy' ? <PrivacyPolicy /> : <UserAgreement />}
        </ScrollView>
      </View>
    </PageContainer>
  );
};

export default Agreement;
